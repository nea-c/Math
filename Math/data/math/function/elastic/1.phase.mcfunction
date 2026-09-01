data modify storage math: internal.w_elastic_phase set compute default float math:elastic/phase
data modify storage math: internal.x set from storage math: max
data modify storage math: internal.y set value 1.0f
function math:.common/reciprocal/0.start
data modify storage math: internal.w_elastic_u set compute default float math:elastic/u
data modify storage math: internal.x set compute default float math:elastic/exponent
function math:.common/exp/0.start
data modify storage math: internal.w_elastic_decay set from storage math: internal.x
data modify storage math: internal.x set from storage math: period
data modify storage math: internal.y set value 1.0f
function math:.common/reciprocal/0.start
data modify storage math: internal.w_elastic_inverse_period set from storage math: internal.x
data modify storage math: internal.x set compute default float math:elastic/angle
function math:.common/sin/0.start
data modify storage math: internal.w_elastic_sine set from storage math: internal.x
return run function math:elastic/2.finish
