data modify storage math:internal w set compute default float math:.common/reciprocal/compare/below_one
execute if predicate math:.validation/comparison/negative_integer run return run function math:.common/reciprocal/1.normalize_low
data modify storage math:internal w set compute default float math:.common/reciprocal/compare/at_least_two
execute unless predicate math:.validation/comparison/negative_integer run return run function math:.common/reciprocal/3.normalize_high
return run function math:.common/reciprocal/4.finish
