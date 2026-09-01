data modify storage math: internal.w set compute default float math:.common/reciprocal/compare/at_least_four
execute unless predicate math:.validation/comparison/negative_integer run return run function math:.common/reciprocal/2.normalize_shared
data modify storage math: internal.x set compute default float math:.common/reciprocal/half_x
data modify storage math: internal.y set compute default float math:.common/reciprocal/half_y
return run function math:.common/reciprocal/4.finish
