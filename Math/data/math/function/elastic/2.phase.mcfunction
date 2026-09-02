data modify storage math: internal.w_elastic_phase set compute default float math:elastic/phase
data modify storage math: internal.time set compute default float {"type":"div","left":{"type":"storage","storage":"math:","path":"t"},"right":{"type":"storage","storage":"math:","path":"max"}}
data modify storage math: internal.w_elastic_decay set compute default float math:elastic/exponent
data modify storage math: internal.w_elastic_inverse_period set compute default float {"type":"div","left":1,"right":{"type":"storage","storage":"math:","path":"period"}}
data modify storage math: internal.w_elastic_sine set compute default float math:elastic/angle
data modify storage math: internal.eased set compute default float math:elastic/eased
data modify storage math: ans set compute default float math:elastic/result
