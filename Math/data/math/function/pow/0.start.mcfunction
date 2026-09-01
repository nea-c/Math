data remove storage math: error
data modify storage math:internal w_validation_a set compute default float math:internal/comparison/finite/a
execute unless data storage math:internal {w_validation_a:0.0f} run return run function math:.common/_error/invalid_number
data modify storage math:internal w_validation_b set compute default float math:internal/comparison/finite/b
execute unless data storage math:internal {w_validation_b:0.0f} run return run function math:.common/_error/invalid_number
data modify storage math:internal x set from storage math: a
data modify storage math:internal y set from storage math: b
execute if data storage math:internal {x:0.0f} run return run function math:pow/1.zero
execute if data storage math:internal {y:1.0f} run data modify storage math: ans set compute default float math:common/input/x
execute if data storage math:internal {y:1.0f} run return 1
data modify storage math:internal w_comparison.x_sign set compute default float math:internal/comparison/x_zero
execute if predicate math:internal/range/negative run return run function math:pow/2.negative
return run function math:pow/3.positive
