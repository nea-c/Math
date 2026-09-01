data modify storage math:internal w set compute default float math:internal/reciprocal/compare/at_least_four
execute unless predicate math:internal/comparison/negative_integer run return run function math:.common/reciprocal/2.normalize_shared
data modify storage math:internal x set compute default float math:internal/reciprocal/half_x
data modify storage math:internal y set compute default float math:internal/reciprocal/half_y
return run function math:.common/reciprocal/4.finish
