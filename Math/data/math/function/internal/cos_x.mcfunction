data modify storage math:internal y set compute default math:common/constant/tau
function math:internal/normalize_period
data modify storage math:internal x set from storage math:internal z
data modify storage math:internal x set compute default math:cos/00
data modify storage math:internal z set from storage math:internal x
data modify storage math:internal x set compute default math:sin/fold/00
data modify storage math:internal x set compute default math:sin/00
return 1
