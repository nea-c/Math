data remove storage math: error
data modify storage math:internal w_validation_a set compute default float math:internal/comparison/finite/a
execute unless data storage math:internal {w_validation_a:0.0f} run return run function math:.common/_error/invalid_number
data modify storage math:internal x set from storage math: a
data modify storage math:internal w_comparison.x_sign set compute default float math:internal/comparison/x_zero
execute if predicate math:internal/range/negative run data remove storage math: ans
execute if predicate math:internal/range/negative run data modify storage math: error set value "negative_square_root"
execute if predicate math:internal/range/negative run return fail
execute if data storage math:internal {x:0.0f} run data modify storage math: ans set value 0.0f
execute if data storage math:internal {x:0.0f} run return 1
data modify storage math: ans set compute default float math:sqrt/00
return 1
