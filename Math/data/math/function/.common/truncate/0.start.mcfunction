data modify storage math:internal w_comparison.x_sign set compute default math:internal/comparison/x_zero
execute unless predicate math:internal/range/negative run return run function math:.common/floor/0.start
data modify storage math:internal x set compute default math:common/rounding/negate
function math:.common/floor/0.start
data modify storage math:internal x set from storage math:internal z
data modify storage math:internal z set compute default math:common/rounding/negate
return 1
