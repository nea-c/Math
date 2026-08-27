data modify storage math:internal z set from storage math:internal x
data modify storage math:internal x set compute default math:common/comparison/absolute
function math:internal/reduce_remainder
data modify storage math:internal w set from storage math:internal z
execute if predicate math:internal/normalize_period/original_negative run return run function math:internal/normalize_period_negative
data modify storage math:internal z set compute default math:common/normalize/period/positive/00
return 1
