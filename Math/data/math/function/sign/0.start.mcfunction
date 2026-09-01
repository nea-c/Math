data remove storage math: ans
data modify storage math: internal.x set from storage math: a
data modify storage math: ans set value 0.0f
data modify storage math: internal.w_comparison.x_sign set compute default float math:.validation/x_zero
execute if predicate math:.validation/range/negative run data modify storage math: ans set value -1.0f
execute if predicate math:.validation/range/positive run data modify storage math: ans set value 1.0f
data remove storage math: internal
