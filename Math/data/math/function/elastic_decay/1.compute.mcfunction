execute if predicate math:interpolation/time_at_or_below_start run return run data modify storage math: ans set from storage math: a
execute if predicate math:interpolation/time_at_or_after_end run return run data modify storage math: ans set from storage math: b
data modify storage math: internal.time set compute default float {"type":"div","left":{"type":"storage","storage":"math:","path":"t"},"right":{"type":"storage","storage":"math:","path":"max"}}
data modify storage math: internal.w_elastic_decay_factor set compute default float math:elastic_decay/exponent
data modify storage math: internal.w_elastic_decay_cosine set compute default float math:elastic_decay/angle
data modify storage math: internal.eased set compute default float math:elastic_decay/eased
data modify storage math: ans set compute default float math:elastic/result
