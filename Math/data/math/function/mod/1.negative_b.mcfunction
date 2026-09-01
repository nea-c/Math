execute if predicate math:.validation/rounding/public/a_negative run data modify storage math:internal x set from storage math:internal z
execute if predicate math:.validation/rounding/public/a_negative run data modify storage math: ans set compute default float math:.common/rounding/negate
execute if predicate math:.validation/rounding/public/a_negative run return 1
data modify storage math:internal x set from storage math:internal z
data modify storage math: ans set compute default float math:.common/sub
return 1
