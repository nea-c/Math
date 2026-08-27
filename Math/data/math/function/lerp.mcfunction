data remove storage math: error
execute unless predicate math:internal/finite/a run data remove storage math: ans
execute unless predicate math:internal/finite/a run data modify storage math: error set value "invalid_number"
execute unless predicate math:internal/finite/a run return fail
execute unless predicate math:internal/finite/b run data remove storage math: ans
execute unless predicate math:internal/finite/b run data modify storage math: error set value "invalid_number"
execute unless predicate math:internal/finite/b run return fail
execute unless predicate math:internal/finite/t run data remove storage math: ans
execute unless predicate math:internal/finite/t run data modify storage math: error set value "invalid_number"
execute unless predicate math:internal/finite/t run return fail
data modify storage math:internal x set from storage math: a
data modify storage math:internal y set from storage math: b
data modify storage math:internal z set from storage math: t
data modify storage math: ans set compute default math:common/arithmetic/lerp
return 1
