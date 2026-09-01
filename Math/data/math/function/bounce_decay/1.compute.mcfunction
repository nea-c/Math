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
function math:bounce_decay/2.finish
