data remove storage math: error
data modify storage math: internal.w_validation_a set compute default float math:.validation/finite/a
execute unless data storage math: {internal:{w_validation_a:0.0f}} run return run function math:.common/_error/invalid_number
data modify storage math: internal.w_validation_b set compute default float math:.validation/finite/b
execute unless data storage math: {internal:{w_validation_b:0.0f}} run return run function math:.common/_error/invalid_number
data modify storage math: internal.w_validation_t set compute default float math:.validation/finite/t
execute unless data storage math: {internal:{w_validation_t:0.0f}} run return run function math:.common/_error/invalid_number
data modify storage math: internal.w_validation_max set compute default float math:.validation/finite/max
execute unless data storage math: {internal:{w_validation_max:0.0f}} run return run function math:.common/_error/invalid_number
data modify storage math: internal.w_validation_bounces set compute default float math:.validation/finite/bounces
execute unless data storage math: {internal:{w_validation_bounces:0.0f}} run return run function math:.common/_error/invalid_number
data modify storage math: internal.w_validation_decay set compute default float math:.validation/finite/decay
execute unless data storage math: {internal:{w_validation_decay:0.0f}} run return run function math:.common/_error/invalid_number
data modify storage math: internal.w_comparison.predicate.bounce_decay_duration_positive set compute default float math:.validation/predicate/bounce_decay/duration_positive/value
execute unless predicate math:.validation/bounce_decay/duration_positive run return run function math:.common/_error/invalid_duration
data modify storage math: internal.w_comparison.predicate.bounce_decay_bounces_positive set compute default float math:.validation/predicate/bounce_decay/bounces_positive/value
execute unless predicate math:.validation/bounce_decay/bounces_positive run return run function math:.common/_error/invalid_bounce
data modify storage math: internal.w_comparison.predicate.bounce_decay_decay_nonnegative set compute default float math:.validation/predicate/bounce_decay/decay_nonnegative/value
execute unless predicate math:.validation/bounce_decay/decay_nonnegative run return run function math:.common/_error/invalid_bounce
data modify storage math: internal.w_comparison.predicate.bounce_decay_time_at_or_below_start set compute default float math:.validation/predicate/bounce_decay/time_at_or_below_start/value
execute if predicate math:.validation/bounce_decay/time_at_or_below_start run data modify storage math: ans set compute default float math:.common/input/a
execute if predicate math:.validation/bounce_decay/time_at_or_below_start run return 1
data modify storage math: internal.w_comparison.predicate.bounce_decay_time_at_or_after_end set compute default float math:.validation/predicate/bounce_decay/time_at_or_after_end/value
execute if predicate math:.validation/bounce_decay/time_at_or_after_end run data modify storage math: ans set compute default float math:.common/input/b
execute if predicate math:.validation/bounce_decay/time_at_or_after_end run return 1
data modify storage math: internal.w_bounce_scaled_t set from storage math: t
data modify storage math: internal.x set from storage math: max
data modify storage math: internal.w_comparison.predicate.bounce_duration_subnormal set compute default float math:.validation/predicate/bounce/duration_subnormal/value
execute if predicate math:.validation/bounce/duration_subnormal run data modify storage math: internal.w_bounce_scaled_t set compute default float math:bounce/scaled_t
execute if predicate math:.validation/bounce/duration_subnormal run data modify storage math: internal.x set compute default float math:bounce/scaled_max
data modify storage math: internal.y set value 1.0f
function math:.common/reciprocal/0.start
data modify storage math: internal.w_bounce_decay_u set compute default float math:bounce_decay/u
data modify storage math: internal.x set compute default float math:bounce_decay/phase
function math:.common/floor/0.start
data modify storage math: internal.w_bounce_decay_wave set compute default float math:bounce_decay/wave
data modify storage math: internal.x set compute default float math:bounce_decay/exponent
function math:.common/exp/0.start
data modify storage math: internal.w_bounce_decay_factor set from storage math: internal.x
return run function math:bounce_decay/1.finish
