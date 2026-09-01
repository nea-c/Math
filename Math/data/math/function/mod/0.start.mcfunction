data remove storage math: error
data modify storage math:internal w_validation_a set compute default float math:internal/comparison/finite/a
execute unless data storage math:internal {w_validation_a:0.0f} run return run function math:.common/_error/invalid_number
data modify storage math:internal w_validation_b set compute default float math:internal/comparison/finite/b
execute unless data storage math:internal {w_validation_b:0.0f} run return run function math:.common/_error/invalid_number
data modify storage math:internal x set from storage math: b
execute if data storage math:internal {x:0.0f} run data remove storage math: ans
execute if data storage math:internal {x:0.0f} run data modify storage math: error set value "division_by_zero"
execute if data storage math:internal {x:0.0f} run return fail
data modify storage math:internal x set from storage math: a
data modify storage math:internal x set compute default float math:.common/abs
data modify storage math:internal z set from storage math:internal x
data modify storage math:internal x set from storage math: b
data modify storage math:internal x set compute default float math:.common/abs
data modify storage math:internal y set from storage math:internal x
data modify storage math:internal x set from storage math:internal z
function math:.common/reduce_remainder/0.start
data modify storage math:internal z set compute default float math:.common/input/x
data modify storage math:internal w_comparison.predicate.rounding_remainder_zero set compute default float math:internal/comparison/predicate/rounding/remainder/zero/value
execute if predicate math:internal/rounding/remainder/zero run data modify storage math: ans set value 0.0f
execute if predicate math:internal/rounding/remainder/zero run return 1
data modify storage math:internal w_comparison.predicate.rounding_public_a_negative set compute default float math:internal/comparison/predicate/rounding/public/a_negative/value
data modify storage math:internal w_comparison.predicate.rounding_public_b_negative set compute default float math:internal/comparison/predicate/rounding/public/b_negative/value
execute if predicate math:internal/rounding/public/b_negative run return run function math:mod/1.negative_b
execute unless predicate math:internal/rounding/public/a_negative run data modify storage math: ans set compute default float math:.common/input/z
execute unless predicate math:internal/rounding/public/a_negative run return 1
data modify storage math:internal x set from storage math:internal y
data modify storage math:internal y set from storage math:internal z
data modify storage math: ans set compute default float math:.common/sub
return 1
