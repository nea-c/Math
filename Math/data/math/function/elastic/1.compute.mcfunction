data modify storage math: internal.w_elastic_amplitude set compute default float math:elastic/input/amplitude
data modify storage math: internal.w_comparison.predicate.elastic_duration_positive set compute default float math:.validation/predicate/elastic/duration_positive/value
execute unless predicate math:.validation/elastic/duration_positive run return 1
data modify storage math: internal.w_comparison.predicate.elastic_amplitude_valid set compute default float math:.validation/predicate/elastic/amplitude_valid/value
execute unless predicate math:.validation/elastic/amplitude_valid run return 1
data modify storage math: internal.w_comparison.predicate.elastic_period_positive set compute default float math:.validation/predicate/elastic/period_positive/value
execute unless predicate math:.validation/elastic/period_positive run return 1
data modify storage math: internal.w_comparison.predicate.elastic_time_at_or_below_start set compute default float math:.validation/predicate/elastic/time_at_or_below_start/value
execute if predicate math:.validation/elastic/time_at_or_below_start run data modify storage math: ans set from storage math: a
execute if predicate math:.validation/elastic/time_at_or_below_start run return 1
data modify storage math: internal.w_comparison.predicate.elastic_time_at_or_after_end set compute default float math:.validation/predicate/elastic/time_at_or_after_end/value
execute if predicate math:.validation/elastic/time_at_or_after_end run data modify storage math: ans set from storage math: b
execute if predicate math:.validation/elastic/time_at_or_after_end run return 1
execute if data storage math: {internal:{w_elastic_amplitude:1.0f}} run data modify storage math: internal.x set compute default float math:.common/asin_positive/half_pi
execute if data storage math: {internal:{w_elastic_amplitude:1.0f}} run function math:elastic/2.phase
execute if data storage math: {internal:{w_elastic_amplitude:1.0f}} run return 1
data modify storage math: internal.x set from storage math: internal.w_elastic_amplitude
data modify storage math: internal.y set value 1.0f
function math:.common/reciprocal/0.start
function math:.common/asin_positive/0.start
function math:elastic/2.phase
