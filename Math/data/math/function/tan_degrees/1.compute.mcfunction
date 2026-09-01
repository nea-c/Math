data modify storage math: internal.x set from storage math: a
data modify storage math: internal.x set compute default float math:.common/rad
execute if data storage math: {internal:{x:0.0f}} run data modify storage math: ans set compute default float math:.common/input/x
execute if data storage math: {internal:{x:0.0f}} run return 1
function math:.common/tan/0.start
data modify storage math: internal.x set from storage math: internal.w_tan_cos
data modify storage math: internal.w_comparison.tan_domain set compute default float math:tan/guard/degrees/compare_domain
data modify storage math: internal.w_comparison.predicate.tan_undefined_degrees set compute default float math:.validation/predicate/tan/undefined_degrees/value
execute if predicate math:.validation/tan/undefined_degrees run return 1
data modify storage math: ans set compute default float math:tan/00
