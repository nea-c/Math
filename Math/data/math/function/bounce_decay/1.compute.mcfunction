execute if predicate math:.validation/.common/interpolation/time_at_or_below_start run return run data modify storage math: ans set from storage math: a
execute if predicate math:.validation/.common/interpolation/time_at_or_after_end run return run data modify storage math: ans set from storage math: b
data modify storage math: internal.w_bounce_decay_u set compute default float {"type":"div","left":{"type":"storage","storage":"math:","path":"t"},"right":{"type":"storage","storage":"math:","path":"max"}}
data modify storage math: internal.x set compute default float math:bounce_decay/phase
data modify storage math: internal.w_bounce_decay_wave set compute default float math:bounce_decay/wave
data modify storage math: internal.x set compute default float math:bounce_decay/exponent
function math:.common/exp/0.start
data modify storage math: internal.w_bounce_decay_factor set from storage math: internal.x
data modify storage math: internal.w_bounce_decay_eased set compute default float math:bounce_decay/eased
data modify storage math: ans set compute default float math:bounce_decay/result
