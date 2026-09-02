data modify storage math: internal.x set from storage math: a
data modify storage math: internal.y set from storage math: b
execute if data storage math: {internal:{x:0.0f}} run return run function math:pow/2.zero
execute if data storage math: {internal:{y:1.0f}} run return run data modify storage math: ans set compute default float math:.common/input/x
data modify storage math: internal.w_comparison.x_sign set compute default float math:.validation/x_zero
execute if predicate math:.validation/range/negative run return run function math:pow/3.negative
function math:pow/4.positive
