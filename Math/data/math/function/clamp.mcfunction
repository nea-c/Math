data remove storage math: error
execute unless predicate math:internal/finite/a run data remove storage math: ans
execute unless predicate math:internal/finite/a run data modify storage math: error set value "invalid_number"
execute unless predicate math:internal/finite/a run return fail
execute unless predicate math:internal/finite/min run data remove storage math: ans
execute unless predicate math:internal/finite/min run data modify storage math: error set value "invalid_number"
execute unless predicate math:internal/finite/min run return fail
execute unless predicate math:internal/finite/max run data remove storage math: ans
execute unless predicate math:internal/finite/max run data modify storage math: error set value "invalid_number"
execute unless predicate math:internal/finite/max run return fail
data modify storage math:internal x set from storage math: a
data modify storage math:internal min set from storage math: min
data modify storage math:internal max set from storage math: max
execute if predicate math:internal/range/min_greater_than_max run data remove storage math: ans
execute if predicate math:internal/range/min_greater_than_max run data modify storage math: error set value "invalid_clamp_range"
execute if predicate math:internal/range/min_greater_than_max run return fail
data modify storage math: ans set compute default math:common/comparison/clamp
return 1
