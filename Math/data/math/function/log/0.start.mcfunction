data remove storage math: error
data modify storage math: internal.w_validation_a set compute default float math:.validation/finite/a
execute unless data storage math: {internal:{w_validation_a:0.0f}} run return run function math:.common/_error/invalid_number
data modify storage math: internal.x set from storage math: a
data modify storage math: internal.w_comparison.x_sign set compute default float math:.validation/x_zero
execute if predicate math:.validation/range/negative run data remove storage math: ans
execute if predicate math:.validation/range/negative run data modify storage math: error set value "non_real_result"
execute if predicate math:.validation/range/negative run return fail
execute if data storage math: {internal:{x:0.0f}} run data remove storage math: ans
execute if data storage math: {internal:{x:0.0f}} run data modify storage math: error set value "non_real_result"
execute if data storage math: {internal:{x:0.0f}} run return fail
function math:.common/log/0.start
data modify storage math: ans set compute default float math:.common/input/x
return 1
