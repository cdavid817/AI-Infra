"""功率与 TCO(第 31 章;可选碳强度输入,计划 11.62)。"""
from .core import Result, Quantity, require_positive


def power_tco(n_gpus: int, gpu_tdp_w: float, host_overhead: float = 1.4, pue: float = 1.3,
              electricity_price_per_kwh: float = 0.6, capex_per_gpu: float = 0.0,
              depreciation_years: float = 4.0, annual_ops_cost: float = 0.0,
              ecosystem_person_months: float = 0.0, person_month_cost: float = 80000.0,
              carbon_intensity_g_per_kwh: float | None = None) -> Result:
    """IT 功率 = 卡数×TDP×整机系数;设施功率 = IT×PUE;年电费与 TCO 五块(第 31 章);
    可选电网碳强度 → 年运行碳排(估算口径,非审计级)。"""
    require_positive(n_gpus=n_gpus, gpu_tdp_w=gpu_tdp_w, pue=pue,
                     electricity_price_per_kwh=electricity_price_per_kwh, depreciation_years=depreciation_years)
    if host_overhead < 1:
        raise ValueError("host_overhead(整机系数 α)≥ 1")
    if capex_per_gpu < 0 or annual_ops_cost < 0 or ecosystem_person_months < 0:
        raise ValueError("成本项不能为负")

    it_kw = n_gpus * gpu_tdp_w * host_overhead / 1000
    facility_kw = it_kw * pue
    annual_kwh = facility_kw * 24 * 365
    annual_power_cost = annual_kwh * electricity_price_per_kwh
    annual_capex = n_gpus * capex_per_gpu / depreciation_years
    annual_eco = ecosystem_person_months * person_month_cost / depreciation_years
    annual_tco = annual_capex + annual_power_cost + annual_ops_cost + annual_eco

    r = Result(name="功率与年化 TCO 估算")
    r.inputs = dict(n_gpus=n_gpus, gpu_tdp_w=gpu_tdp_w, host_overhead=host_overhead, pue=pue,
                    electricity_price_per_kwh=electricity_price_per_kwh, capex_per_gpu=capex_per_gpu,
                    depreciation_years=depreciation_years, annual_ops_cost=annual_ops_cost,
                    ecosystem_person_months=ecosystem_person_months, person_month_cost=person_month_cost,
                    carbon_intensity_g_per_kwh=carbon_intensity_g_per_kwh)
    r.formulas = ["第 31 章:P_total = N×TDP×α×PUE(α 为整机系数)",
                  "第 31 章 TCO 五块:折旧 + 电费 + 机房(并入 PUE 与 ops)+ 运维 + 生态折算(§12.7 人月)"]
    r.outputs = {
        "IT 功率": Quantity(it_kw, "kW"),
        "设施功率(含 PUE)": Quantity(facility_kw, "kW"),
        "年耗电": Quantity(annual_kwh / 1e4, "万 kWh"),
        "年电费": Quantity(annual_power_cost / 1e4, "万元"),
        "年化 TCO": Quantity(annual_tco / 1e4, "万元"),
    }
    if carbon_intensity_g_per_kwh is not None:
        if carbon_intensity_g_per_kwh < 0:
            raise ValueError("碳强度不能为负")
        r.outputs["年运行碳排(估算)"] = Quantity(annual_kwh * carbon_intensity_g_per_kwh / 1e6, "tCO2e")
        r.assumptions = r.assumptions + ["碳排为电网平均强度 × 用电量的运行口径估算,不含设备隐含碳,不可作审计数据(计划 11.63)"]
    r.assumptions += [
        "α(host_overhead)含 CPU/内存/网络/风扇,经验 1.3–1.5(CLM-031-003,经验区间)",
        "电价与人月成本为输入,不提供'典型值'背书;机房改造 CAPEX 未单列,可并入 capex_per_gpu",
    ]
    r.sensitivities = ["利用率不在本式内——每有效 token 成本 = TCO ÷ 有效产出,利用率减半成本翻倍(第 31 章)",
                       "PUE 风冷 1.5 档 vs 液冷 1.2 档,直接差 20%+ 电费(§31.2)"]
    r.uncertainty = "±25%:电价峰谷、机房摊销口径、生态人月都依组织而异。"
    r.replace_with_measurement = "上电后以 PDU 实测功率与月度账单回填;生态人月用第 12 章两周评估的实际输出。"
    return r
