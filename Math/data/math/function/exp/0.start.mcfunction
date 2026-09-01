data remove storage math: error
data modify storage math: internal.w_validation_a set compute default float math:.validation/finite/a
execute unless data storage math: {internal:{w_validation_a:0.0f}} run return run function math:.common/_error/invalid_number
data modify storage math: internal.x set from storage math: a
data modify storage math: internal.w_comparison.predicate.exp_input_in_range set compute default float math:.validation/predicate/exp/input_in_range/value
execute unless predicate math:.validation/exp/input_in_range run data remove storage math: ans
execute unless predicate math:.validation/exp/input_in_range run data modify storage math: error set value "result_out_of_range"
execute unless predicate math:.validation/exp/input_in_range run return fail
data modify storage math: internal.w_comparison.predicate.exp_underflows_to_zero set compute default float math:.validation/predicate/exp/underflows_to_zero/value
execute if predicate math:.validation/exp/underflows_to_zero run data modify storage math: ans set value 0.0f
execute if predicate math:.validation/exp/underflows_to_zero run return 1
execute if data storage math: {internal:{x:-103.97207641601562f}} run data modify storage math: ans set compute default float math:exp/minimum/00
execute if data storage math: {internal:{x:-103.97207641601562f}} run return 1
function math:.common/exp/0.start
data modify storage math: ans set compute default float math:.common/input/x
data modify storage math: internal.w_comparison.predicate.exp_result_finite set compute default float math:.validation/predicate/exp/result_finite/value
execute unless predicate math:.validation/exp/result_finite run data remove storage math: ans
execute unless predicate math:.validation/exp/result_finite run data modify storage math: error set value "result_out_of_range"
execute unless predicate math:.validation/exp/result_finite run return fail
return 1
