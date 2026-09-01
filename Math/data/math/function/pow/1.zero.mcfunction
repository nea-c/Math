execute if data storage math:internal {y:0.0f} run data modify storage math: ans set value 1.0f
execute if data storage math:internal {y:0.0f} run return 1
data modify storage math:internal w_comparison.predicate.power_exponent_negative set compute default float math:.validation/predicate/power/exponent_negative/value
execute if predicate math:.validation/power/exponent_negative run data remove storage math: ans
execute if predicate math:.validation/power/exponent_negative run data modify storage math: error set value "zero_to_negative_power"
execute if predicate math:.validation/power/exponent_negative run return fail
data modify storage math: ans set value 0.0f
return 1
