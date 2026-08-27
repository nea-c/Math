execute if predicate math:internal/power/exponent_negative run data remove storage math: ans
execute if predicate math:internal/power/exponent_negative run data modify storage math: error set value "zero_to_negative_power"
execute if predicate math:internal/power/exponent_negative run return fail
execute if predicate math:internal/power/exponent_zero run data modify storage math: ans set value 1.0f
execute if predicate math:internal/power/exponent_zero run return 1
data modify storage math: ans set value 0.0f
return 1
