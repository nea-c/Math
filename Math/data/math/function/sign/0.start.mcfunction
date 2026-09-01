data remove storage math: error
data modify storage math: internal.w_validation_a set compute default float math:.validation/finite/a
execute unless data storage math: {internal:{w_validation_a:0.0f}} run return run function math:.common/_error/invalid_number
data modify storage math: internal.x set from storage math: a
data modify storage math: ans set value 0.0f
data modify storage math: internal.w_comparison.x_sign set compute default float math:.validation/x_zero
execute if predicate math:.validation/range/negative run data modify storage math: ans set value -1.0f
execute if predicate math:.validation/range/positive run data modify storage math: ans set value 1.0f
return 1
