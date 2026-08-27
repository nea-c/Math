data modify storage math:internal w set compute default math:internal/reciprocal/compare/below_one
execute if predicate math:internal/comparison/negative_integer run return run function math:divide/2.normalize_scale_up
data modify storage math:internal w set compute default math:internal/reciprocal/compare/at_least_two
execute unless predicate math:internal/comparison/negative_integer run return run function math:divide/3.normalize_scale_down
return 1
