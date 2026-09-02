data modify storage math: internal.w_atan_input set from storage math: internal.x
execute if data storage math: {internal:{w_atan_input:0.0f}} run return 1
data modify storage math: internal.w_comparison.predicate.atan_x_negative set compute default float math:.validation/predicate/atan/x_negative/value
data modify storage math: internal.x set compute default float math:.common/abs
data modify storage math: internal.w_comparison.predicate.atan_use_reciprocal set compute default float math:.validation/predicate/atan/use_reciprocal/value
execute if predicate math:.validation/atan/use_reciprocal run function math:.common/atan/1.reciprocal
data modify storage math: internal.w_comparison.predicate.atan_use_pi_four set compute default float math:.validation/predicate/atan/use_pi_four/value
execute if predicate math:.validation/atan/use_pi_four run function math:.common/atan/2.pi_four
data modify storage math: internal.w_atan_square set compute default float math:.common/atan/square
data modify storage math: internal.x set compute default float math:.common/atan/polynomial
execute if predicate math:.validation/atan/use_pi_four run data modify storage math: internal.x set compute default float {"type":"minecraft:add","inputs":[0.7853981852531433,{"type":"minecraft:storage","storage":"math:","path":"internal.x"}]}
execute if predicate math:.validation/atan/use_reciprocal run data modify storage math: internal.x set compute default float math:.common/atan/after_reciprocal
execute if predicate math:.validation/atan/x_negative run data modify storage math: internal.x set compute default float math:.common/rounding/negate
return 1
