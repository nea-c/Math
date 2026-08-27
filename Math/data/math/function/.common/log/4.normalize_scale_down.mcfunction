data modify storage math:internal z set compute default math:log/normalize/half_mantissa/00
data modify storage math:internal w set compute default math:log/normalize/increment_exponent/00
return run function math:.common/log/2.normalize
