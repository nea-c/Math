data modify storage math: internal.w_atan_square set compute default float math:.common/atan/square
data modify storage math: internal.x set compute default float math:.common/atan/polynomial
execute if predicate math:.validation/atan/use_pi_four run data modify storage math: internal.x set compute default float {"type":"minecraft:add","inputs":[0.7853981852531433,{"type":"minecraft:storage","storage":"math:","path":"internal.x"}]}
execute if predicate math:.validation/atan/use_reciprocal run data modify storage math: internal.x set compute default float math:.common/atan/after_reciprocal
execute if predicate math:.validation/atan/x_negative run data modify storage math: internal.x set compute default float math:.common/rounding/negate
return 1
