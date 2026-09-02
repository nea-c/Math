data modify storage math: internal.w_reciprocal_sign set value 1.0f
data modify storage math: internal.w_comparison.x_sign set compute default float math:.validation/x_zero
execute if predicate math:.validation/range/negative run data modify storage math: internal.w_reciprocal_sign set value -1.0f
data modify storage math: internal.x set compute default float math:.common/abs
function math:.common/normalize_binary32/0.start
data modify storage math: internal.x set from storage math: internal.w_normalize_mantissa
data modify storage math: internal.y set compute default float math:.common/reciprocal/scale_a
function math:.common/reciprocal/4.finish
data modify storage math: internal.x set compute default float math:.common/reciprocal/scale_b
return run data modify storage math: internal.x set compute default float math:.common/reciprocal/apply_sign
