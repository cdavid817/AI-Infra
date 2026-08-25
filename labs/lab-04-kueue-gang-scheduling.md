# Lab 04:Kueue 与 Gang 语义演示

| 项 | 值 |
|---|---|
| 等级 | L0(kind 模拟,无 GPU,笔记本可跑)/ L3(真集群,占用调度体系,须与集群管理员协调) |
| 预计资源与成本 | L0:本地 Docker + kind,约 1~2 小时,零成本。L3:一个可自由创建 namespace 与 CRD 的测试集群——**不要在生产集群做本 Lab 的死锁复现** |
| 安全风险 | L0 无。L3:需要安装 CRD 与集群级对象(ClusterQueue),属集群管理权限;死锁复现会占满测试配额,务必用独立队列隔离 |
| 关联章节 | [§9.3 问题场景](../第二部分-算力底座/第09章-批调度器.md#93-问题场景利用率-100进展为零)、[§9.4.1 Gang Scheduling](../第二部分-算力底座/第09章-批调度器.md#941-gang-scheduling同步训练的调度公理)、[§9.4.2 四件套](../第二部分-算力底座/第09章-批调度器.md#942-队列配额优先级抢占四件套的模型设计)、[§9.5 方案对比](../第二部分-算力底座/第09章-批调度器.md#95-方案对比volcano--kueue--slurm) |

## 目标

做完本 Lab,你能回答:

1. "部分调度死锁"到底长什么样——不是背 [§9.3](../第二部分-算力底座/第09章-批调度器.md#93-问题场景利用率-100进展为零) 的故事,而是在自己的集群里让两个任务互锁一次,看到"利用率 100%、进展为零";
2. 作业级准入(admission)如何实现"要么整个作业放行、要么一个 Pod 不建"的 Gang 效果,以及它与调度器层 gang 插件的分工([§9.5](../第二部分-算力底座/第09章-批调度器.md#95-方案对比volcano--kueue--slurm) 的准入/放置分离);
3. 弹性配额的 min/max 与 cohort 借用如何工作,借来的资源什么时候被收回([§9.4.2](../第二部分-算力底座/第09章-批调度器.md#942-队列配额优先级抢占四件套的模型设计))。

## 步骤

**第一步:建实验集群(L0)。** 用 kind 起一个单节点集群,再安装 Kueue(按官方 manifests 安装,不锁版本)。L3 路径:在测试集群安装,后续步骤相同,只是资源名可换成真实加速卡资源。

```bash
kind create cluster --name kueue-lab
kubectl apply --server-side -f <Kueue 官方发布 manifests>
kubectl -n kueue-system get pods   # 等 controller 就绪
```

**第二步:构造"资源不足以同时容纳两个任务"的格局。** 本 Lab 用 CPU 模拟卡:查看节点可分配 CPU(`kubectl describe node`),设计两个各需 6 个副本、每副本 requests 1 CPU 的"训练任务",并保证节点可分配量在 6~11 之间(不够就给 kind 节点数或副本数做算术调整)——即**任一任务单独能跑满,两个同时到达则总需求超额**,复刻 [§9.4.1](../第二部分-算力底座/第09章-批调度器.md#941-gang-scheduling同步训练的调度公理) 的 R < kG 条件。

**第三步:复现无 Gang 的互锁。** 先不经 Kueue,直接提交两个普通 Job。用"worker 起来后等待全组到齐才开工"来模拟同步训练的刚性依赖——最简做法是容器进程无限等待(`sleep infinity`),Pod Running 即代表"占住卡等 AllReduce 凑齐":

```yaml
# job-a.yaml 与 job-b.yaml 相同,仅改名
apiVersion: batch/v1
kind: Job
metadata: {name: train-a}
spec:
  completions: 6
  parallelism: 6
  template:
    spec:
      restartPolicy: Never
      containers:
      - name: worker
        image: busybox
        command: ["sh", "-c", "sleep infinity"]
        resources: {requests: {cpu: "1"}}
```

同时 `kubectl apply` 两个 Job,然后观察:

```bash
kubectl get pods -o wide          # 两个 Job 各有部分 Pod Running、部分 Pending
kubectl describe node | grep -A8 'Allocated resources'   # CPU 已被占满
```

预期形态:A 和 B 各拿到一部分副本,谁也凑不齐 6 个,谁也不释放——节点资源占用接近 100%,两个作业的完成数永远是 0。这就是部分调度死锁;记录两个 Job 各自 Running/Pending 的分布。观察完删除两个 Job。

**第四步:引入 Kueue,验证整进整出。** 创建单集群队列与本地队列(CPU 配额设为恰好容纳一个任务,如 6):

```yaml
apiVersion: kueue.x-k8s.io/v1beta1
kind: ResourceFlavor
metadata: {name: default-flavor}
---
apiVersion: kueue.x-k8s.io/v1beta1
kind: ClusterQueue
metadata: {name: team-a}
spec:
  namespaceSelector: {}
  resourceGroups:
  - coveredResources: ["cpu"]
    flavors:
    - name: default-flavor
      resources: [{name: "cpu", nominalQuota: 6}]
---
apiVersion: kueue.x-k8s.io/v1beta1
kind: LocalQueue
metadata: {name: team-a-queue, namespace: default}
spec: {clusterQueue: team-a}
```

给两个 Job 加标签 `kueue.x-k8s.io/queue-name: team-a-queue`(并把 `sleep infinity` 改成 `sleep 60`,让任务能自然结束),同时提交。观察:

```bash
kubectl get workloads -n default     # 一个 Admitted,一个排队
kubectl get jobs                     # A 的 6 个 Pod 同时创建;B 的 Job 处于 suspended,0 个 Pod
```

预期形态:先被准入的作业**6 个副本一次性全部放行**并跑完;另一个在队列里**一个 Pod 也不创建**,等配额释放后整体进入。这就是"整进整出"——对比第三步,同样的资源格局,结局从死锁变成串行完成。

**第五步:演示配额借用。** 把格局改成两个队伍:再建一个 ClusterQueue `team-b`,两者都加入同一 `cohort`,各自 `nominalQuota` 设为节点容量的一半,并给 team-a 配置 `borrowingLimit`(或不设上限)。先只向 team-a 提交一个超出自己保底、但在"自身保底 + 可借额度"内的任务,观察它借用 team-b 的闲置配额被准入;再向 team-b 提交任务,观察归还/回收行为(是否发生抢占取决于 Kueue 的抢占策略配置,把你观察到的行为与 [§9.4.2](../第二部分-算力底座/第09章-批调度器.md#942-队列配额优先级抢占四件套的模型设计) "借来的部分在出借方需要时应可回收"对照,记录实际语义)。

**第六步(思考题,不动手):** 本 Lab 的准入层 Gang 保证"配额意义上整进整出",但 Pod 放行后仍由默认调度器逐个放置——什么场景下这还不够、需要调度器层的 gang/拓扑插件?对照 [§9.5 两层职责的分界](../第二部分-算力底座/第09章-批调度器.md#调度准入与作业控制器两层职责的分界) 写出你的答案。

## 成功判据

- 第三步复现互锁:两个 Job 的 Pod 各占部分资源、完成数长期为 0,节点 CPU 分配接近满——与 [§9.3](../第二部分-算力底座/第09章-批调度器.md#93-问题场景利用率-100进展为零) "利用率 100%、进展为零"的形态一致;
- 第四步复现整进整出:任意时刻最多一个作业的 Pod 存在,且该作业的全部副本同时创建;两个作业先后都能跑完;
- 第五步观察到一次成功的跨队列借用(team-a 实际占用 > 自身 nominalQuota),并能说清回收发生的条件;
- 能用 [§9.4.1](../第二部分-算力底座/第09章-批调度器.md#941-gang-scheduling同步训练的调度公理) 的空耗卡时公式,估算第三步的死锁若发生在 512 卡真集群上一天的损失量级。

## 清理步骤

```bash
kubectl delete job --all -n default
kubectl delete localqueue --all -n default
kubectl delete clusterqueue team-a team-b
kubectl delete resourceflavor default-flavor
kind delete cluster --name kueue-lab      # L0:整个集群一并删除
```

L3:按上述顺序删除本 Lab 创建的全部对象,并与管理员确认 Kueue 组件是否需要卸载;确认测试队列删除后不影响既有队列的准入。

## 常见失败与排查

1. **第三步没有死锁,一个 Job 拿满了 6 个副本**:资源格局不满足 R < kG 或两个 Job 提交间隔太长(调度器连续处理完了同一个队列)。缩小节点可分配量、或提高每任务副本数(交错概率随副本数上升,见 [§9.4.1](../第二部分-算力底座/第09章-批调度器.md#941-gang-scheduling同步训练的调度公理)),并用同一条命令同时 apply。
2. **加了队列标签的 Job 一直 suspended、无任何 Workload 事件**:LocalQueue 与 Job 不在同一 namespace,或 ClusterQueue 的 `namespaceSelector` 不匹配;`kubectl describe workload` 看准入失败原因。
3. **配额明明够却不准入**:检查 ResourceFlavor 与节点标签的匹配、以及 Job 是否还申请了 ClusterQueue 未覆盖的资源(memory 等)——未覆盖的资源不参与记账但覆盖列表配置错会整体拒绝。
4. **借用不发生**:两个 ClusterQueue 的 `cohort` 字段不一致,或借用方任务超出了"保底 + borrowingLimit"。逐项核对 [§9.4.2](../第二部分-算力底座/第09章-批调度器.md#942-队列配额优先级抢占四件套的模型设计) 弹性配额三元组的每一项在 YAML 里的对应字段。
