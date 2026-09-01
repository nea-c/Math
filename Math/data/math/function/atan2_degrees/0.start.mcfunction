data remove storage math: error
data modify storage math:internal w_validation_a set compute default float math:internal/comparison/finite/a
execute unless data storage math:internal {w_validation_a:0.0f} run return run function math:.common/_error/invalid_number
data modify storage math:internal w_validation_b set compute default float math:internal/comparison/finite/b
execute unless data storage math:internal {w_validation_b:0.0f} run return run function math:.common/_error/invalid_number
data modify storage math:internal w_atan2_absolute_a set compute default float math:atan2/absolute_a
data modify storage math:internal w_atan2_absolute_b set compute default float math:atan2/absolute_b
data modify storage math:internal w_atan2_minimum set compute default float math:atan2/minimum
data modify storage math:internal w_atan2_maximum set compute default float math:atan2/maximum
data modify storage math:internal w_comparison.predicate.atan2_maximum_zero set compute default float math:internal/comparison/predicate/atan2/maximum_zero/value
execute if predicate math:internal/atan2/maximum_zero run data modify storage math: ans set value 0.0f
execute if predicate math:internal/atan2/maximum_zero run return 1
data modify storage math:internal w_comparison.predicate.atan2_a_dominant set compute default float math:internal/comparison/predicate/atan2/a_dominant/value
data modify storage math:internal w_comparison.predicate.atan2_a_negative set compute default float math:internal/comparison/predicate/atan2/a_negative/value
data modify storage math:internal w_comparison.predicate.atan2_b_negative set compute default float math:internal/comparison/predicate/atan2/b_negative/value
data modify storage math:internal w_comparison.predicate.atan2_maximum_subnormal set compute default float math:internal/comparison/predicate/atan2/maximum_subnormal/value
execute if predicate math:internal/atan2/maximum_subnormal run data modify storage math:internal w_atan2_minimum set compute default float math:atan2/scaled_minimum
execute if predicate math:internal/atan2/maximum_subnormal run data modify storage math:internal w_atan2_maximum set compute default float math:atan2/scaled_maximum
data modify storage math:internal x set from storage math:internal w_atan2_maximum
data modify storage math:internal y set value 1.0f
function math:.common/reciprocal/0.start
data modify storage math:internal x set compute default float math:atan2/ratio
function math:.common/atan/0.start
execute if predicate math:internal/atan2/a_dominant run data modify storage math:internal x set compute default float math:atan2/from_y_axis
execute if predicate math:internal/atan2/b_negative run data modify storage math:internal x set compute default float math:atan2/from_negative_x
execute if predicate math:internal/atan2/a_negative run data modify storage math:internal x set compute default float math:.common/rounding/negate
data modify storage math:internal x set compute default float math:.common/conversion/deg
data modify storage math: ans set from storage math:internal x
return 1
