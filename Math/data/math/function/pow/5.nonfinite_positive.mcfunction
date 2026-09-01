data modify storage math:internal w_comparison.x_sign set compute default float math:.validation/x_zero
execute if predicate math:.validation/range/negative run data modify storage math: ans set value 0.0f
execute if predicate math:.validation/range/negative run return 1
data remove storage math: ans
data modify storage math: error set value "result_out_of_range"
return fail
