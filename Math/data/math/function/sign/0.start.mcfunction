data remove storage math: error
data modify storage math:internal w_validation_a set compute default math:internal/comparison/finite/a
execute unless data storage math:internal {w_validation_a:0.0f} run return run function math:.common/invalid_number/0.start
data modify storage math:internal x set from storage math: a
data modify storage math: ans set value 0.0f
data modify storage math:internal w_comparison.x_sign set compute default math:internal/comparison/x_zero
execute if predicate math:internal/range/negative run data modify storage math: ans set value -1.0f
execute if predicate math:internal/range/positive run data modify storage math: ans set value 1.0f
return 1
