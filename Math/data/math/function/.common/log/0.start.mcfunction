function math:.common/log/1.prepare
data modify storage math:internal z set compute default math:log/normalize/numerator/00
data modify storage math:internal x set compute default math:log/normalize/denominator/00
data modify storage math:internal x set compute default math:internal/reciprocal/log_denominator
data modify storage math:internal z set compute default math:log/normalize/u/00
data modify storage math:internal x set compute default math:log/00
return 1
