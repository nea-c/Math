data modify storage math:internal z set from storage math:internal x
data modify storage math:internal w set value 0.0f
function math:.common/log/2.normalize
data modify storage math:internal x set compute default math:log/normalize/compare_center/00
execute unless predicate math:internal/comparison/x_negative_integer run data modify storage math:internal z set compute default math:log/normalize/half_mantissa/00
execute unless predicate math:internal/comparison/x_negative_integer run data modify storage math:internal w set compute default math:log/normalize/increment_exponent/00
return 1
