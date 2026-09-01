data modify storage math:internal z set from storage math:internal x
data modify storage math:internal x set compute default float math:common/comparison/absolute
function math:.common/reduce_remainder/0.start
data modify storage math:internal w_comparison.period_half set compute default float math:common/normalize/period/compare_half
data modify storage math:internal w_comparison.period_original set compute default float math:common/normalize/period/compare_original
data modify storage math:internal w set from storage math:internal z
execute if predicate math:internal/normalize_period/original_negative run return run function math:.common/normalize_period/1.negative
data modify storage math:internal z set compute default float math:common/normalize/period/positive/00
return 1
