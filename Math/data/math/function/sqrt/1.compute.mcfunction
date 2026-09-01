data modify storage math: internal.x set from storage math: a
data modify storage math: internal.w_comparison.x_sign set compute default float math:.validation/x_zero
execute if predicate math:.validation/range/negative run return 1
execute if data storage math: {internal:{x:0.0f}} run data modify storage math: ans set value 0.0f
execute if data storage math: {internal:{x:0.0f}} run return 1
data modify storage math: ans set compute default float math:sqrt/00
