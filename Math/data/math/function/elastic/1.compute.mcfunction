data modify storage math: internal.w_elastic_amplitude set compute default float {"type":"minecraft:storage","storage":"math:","path":"amplitude"}
data modify storage math: internal.w_comparison.predicate.elastic_time_at_or_below_start set compute default float math:.validation/predicate/elastic/time_at_or_below_start/value
execute if predicate math:.validation/elastic/time_at_or_below_start run return run data modify storage math: ans set from storage math: a
data modify storage math: internal.w_comparison.predicate.elastic_time_at_or_after_end set compute default float math:.validation/predicate/elastic/time_at_or_after_end/value
execute if predicate math:.validation/elastic/time_at_or_after_end run return run data modify storage math: ans set from storage math: b
execute if data storage math: {internal:{w_elastic_amplitude:1.0f}} run data modify storage math: internal.x set compute default float math:.common/asin_positive/half_pi
execute if data storage math: {internal:{w_elastic_amplitude:1.0f}} run return run function math:elastic/2.phase
data modify storage math: internal.x set from storage math: internal.w_elastic_amplitude
data modify storage math: internal.y set value 1.0f
function math:.common/reciprocal/0.start
function math:.common/asin_positive/0.start
function math:elastic/2.phase
