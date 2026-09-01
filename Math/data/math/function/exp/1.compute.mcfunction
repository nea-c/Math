data modify storage math: internal.x set from storage math: a
data modify storage math: internal.w_comparison.predicate.exp_underflows_to_zero set compute default float math:.validation/predicate/exp/underflows_to_zero/value
execute if predicate math:.validation/exp/underflows_to_zero run data modify storage math: ans set value 0.0f
execute if predicate math:.validation/exp/underflows_to_zero run return 1
execute if data storage math: {internal:{x:-103.97207641601562f}} run data modify storage math: ans set compute default float 1.401298464324817e-45
execute if data storage math: {internal:{x:-103.97207641601562f}} run return 1
function math:.common/exp/0.start
data modify storage math: ans set compute default float math:.common/input/x
