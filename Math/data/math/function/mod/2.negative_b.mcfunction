execute if predicate math:.validation/rounding/public/a_negative run return run function math:mod/3.negative_a
data modify storage math: internal.x set from storage math: internal.z
return run data modify storage math: ans set compute default float math:.common/sub
