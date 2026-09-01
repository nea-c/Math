data modify storage math: internal.w_bounce_eased set compute default float math:bounce/eased
data modify storage math: ans set compute default float math:bounce/result
data modify storage math: internal.w_validation_ans set compute default float math:.validation/finite/ans
execute unless data storage math: {internal:{w_validation_ans:0.0f}} run return run function math:.common/_error/result_out_of_range
return 1
