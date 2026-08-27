data modify storage math:internal w set compute default math:internal/reciprocal/compare/scale_at_limit
execute unless predicate math:internal/comparison/negative_integer run return run function math:.common/reciprocal/2.finish_at_scale_limit
data modify storage math:internal x set compute default math:internal/reciprocal/double_x
data modify storage math:internal y set compute default math:internal/reciprocal/double_y
return run function math:.common/reciprocal/0.start
