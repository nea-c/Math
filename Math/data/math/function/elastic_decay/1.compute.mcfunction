data modify storage math: internal.w_comparison.predicate.elastic_decay_time_at_or_below_start set compute default float math:.validation/predicate/elastic_decay/time_at_or_below_start/value
execute if predicate math:.validation/elastic_decay/time_at_or_below_start run return run data modify storage math: ans set from storage math: a
data modify storage math: internal.w_comparison.predicate.elastic_decay_time_at_or_after_end set compute default float math:.validation/predicate/elastic_decay/time_at_or_after_end/value
execute if predicate math:.validation/elastic_decay/time_at_or_after_end run return run data modify storage math: ans set from storage math: b
data modify storage math: internal.x set from storage math: max
data modify storage math: internal.y set value 1.0f
function math:.common/reciprocal/0.start
data modify storage math: internal.w_elastic_decay_u set compute default float math:elastic_decay/u
data modify storage math: internal.x set compute default float math:elastic_decay/exponent
function math:.common/exp/0.start
data modify storage math: internal.w_elastic_decay_factor set from storage math: internal.x
data modify storage math: internal.x set compute default float math:elastic_decay/angle
function math:.common/cos/0.start
data modify storage math: internal.w_elastic_decay_cosine set from storage math: internal.x
function math:elastic_decay/2.finish
