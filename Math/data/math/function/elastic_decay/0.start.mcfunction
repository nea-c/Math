data remove storage math: error
data modify storage math: internal.w_validation_a set compute default float math:.validation/finite/a
execute unless data storage math: {internal:{w_validation_a:0.0f}} run return run function math:.common/_error/invalid_number
data modify storage math: internal.w_validation_b set compute default float math:.validation/finite/b
execute unless data storage math: {internal:{w_validation_b:0.0f}} run return run function math:.common/_error/invalid_number
data modify storage math: internal.w_validation_t set compute default float math:.validation/finite/t
execute unless data storage math: {internal:{w_validation_t:0.0f}} run return run function math:.common/_error/invalid_number
data modify storage math: internal.w_validation_max set compute default float math:.validation/finite/max
execute unless data storage math: {internal:{w_validation_max:0.0f}} run return run function math:.common/_error/invalid_number
data modify storage math: internal.w_validation_oscillations set compute default float math:.validation/finite/oscillations
execute unless data storage math: {internal:{w_validation_oscillations:0.0f}} run return run function math:.common/_error/invalid_number
data modify storage math: internal.w_validation_damping set compute default float math:.validation/finite/damping
execute unless data storage math: {internal:{w_validation_damping:0.0f}} run return run function math:.common/_error/invalid_number
data modify storage math: internal.w_comparison.predicate.elastic_decay_duration_positive set compute default float math:.validation/predicate/elastic_decay/duration_positive/value
execute unless predicate math:.validation/elastic_decay/duration_positive run return run function math:.common/_error/invalid_duration
data modify storage math: internal.w_comparison.predicate.elastic_decay_oscillations_positive set compute default float math:.validation/predicate/elastic_decay/oscillations_positive/value
execute unless predicate math:.validation/elastic_decay/oscillations_positive run return run function math:.common/_error/invalid_elastic
data modify storage math: internal.w_comparison.predicate.elastic_decay_damping_positive set compute default float math:.validation/predicate/elastic_decay/damping_positive/value
execute unless predicate math:.validation/elastic_decay/damping_positive run return run function math:.common/_error/invalid_elastic
data modify storage math: internal.w_comparison.predicate.elastic_decay_time_at_or_below_start set compute default float math:.validation/predicate/elastic_decay/time_at_or_below_start/value
execute if predicate math:.validation/elastic_decay/time_at_or_below_start run data modify storage math: ans set from storage math: a
execute if predicate math:.validation/elastic_decay/time_at_or_below_start run return 1
data modify storage math: internal.w_comparison.predicate.elastic_decay_time_at_or_after_end set compute default float math:.validation/predicate/elastic_decay/time_at_or_after_end/value
execute if predicate math:.validation/elastic_decay/time_at_or_after_end run data modify storage math: ans set from storage math: b
execute if predicate math:.validation/elastic_decay/time_at_or_after_end run return 1
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
return run function math:elastic_decay/1.finish
