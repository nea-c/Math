data remove storage math: error
data modify storage math: internal.w_validation_a set compute default float math:.validation/finite/a
execute unless data storage math: {internal:{w_validation_a:0.0f}} run return run function math:.common/_error/invalid_number
data modify storage math: internal.x set from storage math: a
data modify storage math: ans set compute default float math:.common/rounding/round
return 1
