execute if data storage math:internal {y:0.0f} run data modify storage math: ans set value 1.0f
execute if data storage math:internal {y:0.0f} run return 1
data modify storage math:internal w_comparison.predicate.power_exponent_negative.maximum set compute default math:internal/comparison/predicate/power/exponent_negative/maximum
execute if predicate math:internal/power/exponent_negative run data remove storage math: ans
execute if predicate math:internal/power/exponent_negative run data modify storage math: error set value "zero_to_negative_power"
execute if predicate math:internal/power/exponent_negative run return fail
data modify storage math: ans set value 0.0f
return 1
