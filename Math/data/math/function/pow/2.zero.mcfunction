execute if data storage math: {internal:{y:0.0f}} run return run data modify storage math: ans set value 1.0f
data modify storage math: internal.w_comparison.predicate.power_exponent_negative set compute default float math:.validation/predicate/power/exponent_negative/value
execute if predicate math:.validation/power/exponent_negative run return 1
return run data modify storage math: ans set value 0.0f
