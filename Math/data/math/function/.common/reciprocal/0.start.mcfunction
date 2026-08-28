data modify storage math:internal w set compute default math:internal/reciprocal/compare/below_one
execute if predicate math:internal/comparison/negative_integer run return run function math:.common/reciprocal/1.normalize_low
data modify storage math:internal w set compute default math:internal/reciprocal/compare/at_least_two
execute unless predicate math:internal/comparison/negative_integer run return run function math:.common/reciprocal/3.normalize_high
return run function math:.common/reciprocal/4.finish
